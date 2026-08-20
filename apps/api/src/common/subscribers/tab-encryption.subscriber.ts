import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  LoadEvent,
} from 'typeorm';
import { Tab } from '../../modules/tab/entities/tab.entity';
import { EncryptionService } from '../services/encryption.service';

/**
 * Transparently encrypts the Tab.customer_name (PII) at rest and decrypts it on
 * read. All existing read/write call sites keep working unchanged because the
 * subscriber transforms the value on the entity before save and after load.
 */
@EventSubscriber()
export class TabEncryptionSubscriber
  implements EntitySubscriberInterface<Tab>
{
  private readonly encryptionService: EncryptionService;

  constructor() {
    // TypeORM instantiates subscribers directly (not through the Nest DI
    // container), so the service is constructed here. The key is derived
    // deterministically from env, so this matches the injected instance.
    this.encryptionService = new EncryptionService();
  }

  listenTo() {
    return Tab;
  }

  beforeInsert(event: InsertEvent<Tab>): void {
    event.entity.customer_name = this.encryptionService.encrypt(
      event.entity.customer_name,
    );
  }

  beforeUpdate(event: UpdateEvent<Tab>): void {
    const value = event.entity?.customer_name ?? event.databaseEntity?.customer_name;
    if (event.entity && value !== undefined) {
      event.entity.customer_name = this.encryptionService.encrypt(value);
    }
  }

  afterLoad(entity: Tab): void {
    entity.customer_name = this.encryptionService.decrypt(entity.customer_name);
  }
}