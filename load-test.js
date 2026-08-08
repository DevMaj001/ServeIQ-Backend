import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const loginDuration = new Trend('login_duration');
export const tabOpenDuration = new Trend('tab_open_duration');
export const orderAddDuration = new Trend('order_add_duration');
export const billGenerateDuration = new Trend('bill_generate_duration');
export const paymentDuration = new Trend('payment_duration');
export const requestsTotal = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up
    { duration: '1m', target: 50 },    // Warm up
    { duration: '2m', target: 100 },   // Peak load - 100 concurrent waiters
    { duration: '1m', target: 100 },   // Sustain
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],       // 95th percentile < 500ms
    http_req_failed: ['rate<0.01'],         // Error rate < 1%
    errors: ['rate<0.05'],                  // Custom error rate < 5%
    login_duration: ['p(95)<1000'],         // Login < 1s
    tab_open_duration: ['p(95)<300'],       // Open tab < 300ms
    order_add_duration: ['p(95)<200'],      // Add order < 200ms
    bill_generate_duration: ['p(95)<500'],  // Generate bill < 500ms
    payment_duration: ['p(95)<300'],        // Process payment < 300ms
  },
};

// Environment variables (set via -e or k6 run --env)
const BASE_URL = __ENV.BASE_URL || 'https://serveiq-backend.onrender.com';
const BUSINESS_CODE = __ENV.BUSINESS_CODE || 'DEMO123';
const WAITER_PIN = __ENV.WAITER_PIN || '1234';

// Test data - will be populated during test
const testState = {
  accessToken: '',
  branchId: '',
  tableId: '',
  tabId: '',
  menuItemIds: [],
  orderIds: [],
};

export function setup() {
  // Verify API is reachable
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health check ok': (r) => r.status === 200 });
  
  // Resolve business to get branch
  const resolveRes = http.post(`${BASE_URL}/api/v1/auth/resolve-business`, 
    JSON.stringify({ business_code: BUSINESS_CODE }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(resolveRes, { 'resolve business ok': (r) => r.status === 200 });
  const businessData = resolveRes.json();
  
  if (!businessData?.branch?.id) {
    throw new Error('Failed to resolve business');
  }
  
  return {
    branchId: businessData.branch.id,
    baseUrl: BASE_URL,
  };
}

export default function (data) {
  const { branchId, baseUrl } = data;
  
  // 1. Waiter Login
  group('Waiter Login', () => {
    const startLogin = new Date();
    const loginRes = http.post(`${baseUrl}/api/v1/auth/waiter-login`,
      JSON.stringify({ pin: WAITER_PIN, business_id: branchId }),
      { 
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'waiter-login' }
      }
    );
    loginDuration.add(new Date() - startLogin);
    
    const loginOk = check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'has access_token': (r) => r.json('access_token') !== undefined,
      'has user data': (r) => r.json('user') !== undefined,
    });
    
    errorRate.add(!loginOk);
    requestsTotal.add(1);
    
    if (loginOk) {
      testState.accessToken = loginRes.json('access_token');
      testState.branchId = branchId;
    }
  });
  
  if (!testState.accessToken) {
    sleep(1);
    return;
  }
  
  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testState.accessToken}`,
    },
    tags: { endpoint: 'authenticated' },
  };
  
  // 2. Get Tables (to find available table)
  group('Get Tables', () => {
    const tablesRes = http.get(`${baseUrl}/api/v1/tables?branch_id=${branchId}`, authHeaders);
    const tablesOk = check(tablesRes, {
      'tables status 200': (r) => r.status === 200,
      'has tables': (r) => r.json('data')?.length > 0,
    });
    errorRate.add(!tablesOk);
    requestsTotal.add(1);
    
    if (tablesOk) {
      const tables = tablesRes.json('data');
      const availableTable = tables.find((t: any) => t.status === 'AVAILABLE');
      if (availableTable) {
        testState.tableId = availableTable.id;
      }
    }
  });
  
  // 3. Get Menu Items
  group('Get Menu', () => {
    const menuRes = http.get(`${baseUrl}/api/v1/menu-items?branch_id=${branchId}&is_available=true`, authHeaders);
    const menuOk = check(menuRes, {
      'menu status 200': (r) => r.status === 200,
      'has items': (r) => r.json('data')?.length > 0,
    });
    errorRate.add(!menuOk);
    requestsTotal.add(1);
    
    if (menuOk) {
      const items = menuRes.json('data');
      testState.menuItemIds = items.slice(0, 5).map((i: any) => i.id);
    }
  });
  
  // 4. Open Tab
  if (testState.tableId && testState.menuItemIds.length > 0) {
    group('Open Tab', () => {
      const startTab = new Date();
      const tabRes = http.post(`${baseUrl}/api/v1/tabs/open`,
        JSON.stringify({ 
          branch_id: branchId, 
          table_id: testState.tableId,
          customer_name: `Load Test Customer ${__VU}`,
          party_size: 2,
        }),
        authHeaders
      );
      tabOpenDuration.add(new Date() - startTab);
      
      const tabOk = check(tabRes, {
        'open tab status 201': (r) => r.status === 201,
        'has tab': (r) => r.json('id') !== undefined,
        'tab status open': (r) => r.json('status') === 'open',
      });
      errorRate.add(!tabOk);
      requestsTotal.add(1);
      
      if (tabOk) {
        testState.tabId = tabRes.json('id');
      }
    });
  }
  
  // 5. Add Orders (multiple rounds)
  if (testState.tabId && testState.menuItemIds.length > 0) {
    for (let round = 1; round <= 3; round++) {
      group(`Add Order - Round ${round}`, () => {
        const items = testState.menuItemIds.slice(0, 3).map((id, idx) => ({
          menu_item_id: id,
          quantity: idx + 1,
          round_number: round,
        }));
        
        const startOrder = new Date();
        const orderRes = http.post(`${baseUrl}/api/v1/orders/tab/${testState.tabId}`,
          JSON.stringify({ items }),
          authHeaders
        );
        orderAddDuration.add(new Date() - startOrder);
        
        const orderOk = check(orderRes, {
          'order status 201': (r) => r.status === 201,
          'has orders': (r) => r.json().length > 0,
        });
        errorRate.add(!orderOk);
        requestsTotal.add(1);
        
        if (orderOk) {
          const orders = orderRes.json();
          testState.orderIds.push(...orders.map((o: any) => o.id));
        }
      });
      
      sleep(0.5); // Small delay between rounds
    }
  }
  
  // 6. Generate Bill
  if (testState.tabId) {
    group('Generate Bill', () => {
      const startBill = new Date();
      const billRes = http.post(`${baseUrl}/api/v1/bills/tab/${testState.tabId}/generate`,
        JSON.stringify({}),
        authHeaders
      );
      billGenerateDuration.add(new Date() - startBill);
      
      const billOk = check(billRes, {
        'bill status 201': (r) => r.status === 201,
        'has bill': (r) => r.json('id') !== undefined,
        'total > 0': (r) => r.json('total_kobo') > 0,
      });
      errorRate.add(!billOk);
      requestsTotal.add(1);
    });
  }
  
  // 7. Process Payment
  if (testState.tabId) {
    group('Process Payment', () => {
      const startPay = new Date();
      const payRes = http.post(`${baseUrl}/api/v1/bills/tab/${testState.tabId}/pay`,
        JSON.stringify({
          method: 'cash',
          amount: 10000, // Will be adjusted by bill total in real scenario
          idempotency_key: `load-test-${__VU}-${__ITER}`,
        }),
        authHeaders
      );
      paymentDuration.add(new Date() - startPay);
      
      const payOk = check(payRes, {
        'payment status 201': (r) => r.status === 201,
        'bill paid': (r) => r.json('paid_at') !== undefined,
      });
      errorRate.add(!payOk);
      requestsTotal.add(1);
    });
  }
  
  // 8. Close Tab
  if (testState.tabId) {
    group('Close Tab', () => {
      const closeRes = http.post(`${baseUrl}/api/v1/tabs/${testState.tabId}/close`, {}, authHeaders);
      const closeOk = check(closeRes, {
        'close tab status 200': (r) => r.status === 200,
        'tab status paid': (r) => r.json('status') === 'paid',
      });
      errorRate.add(!closeOk);
      requestsTotal.add(1);
    });
  }
  
  // Think time between iterations
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown(data) {
  // Summary logging
  console.log('Test completed');
  console.log(`Base URL: ${data.baseUrl}`);
  console.log(`Branch ID: ${data.branchId}`);
}