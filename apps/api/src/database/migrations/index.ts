/**
 * Canonical migration registry — the ONLY place migrations are enumerated.
 *
 * Both the runtime connection (app.module.ts, migrationsRun: true) and the
 * TypeORM CLI data source (data-source.ts) import ALL_MIGRATIONS from here,
 * so a migration registered once runs everywhere. Before this file existed,
 * app.module.ts hand-listed 55 of 78 migrations and 23 never ran at boot.
 *
 * Adding a migration:
 *   1. Create the file in this directory (migration:generate names it).
 *   2. Import it below and append it to ALL_MIGRATIONS in timestamp order.
 * The completeness spec (migrations.registry.spec.ts) fails the build if a
 * file in this directory is missing from the array.
 */
import { BackfillUserRoleId1752892800000 } from './1752892800000-BackfillUserRoleId';
import { MakeUserRoleIdNotNull1752892800001 } from './1752892800001-MakeUserRoleIdNotNull';
import { CreateBaseTables1782000000000 } from './1782000000000-CreateBaseTables';
import { StandardizeUuidTypes1782053106763 } from './1782053106763-StandardizeUuidTypes';
import { AddTaxRateToBusiness1782747664791 } from './1782747664791-AddTaxRateToBusiness';
import { EnsureSchemaConsistency1783000000000 } from './1783000000000-EnsureSchemaConsistency';
import { CreatePlansAndSubscriptions1784000000000 } from './1784000000000-CreatePlansAndSubscriptions';
import { BackfillSubscriptionsForExistingBranches1784000000001 } from './1784000000001-BackfillSubscriptionsForExistingBranches';
import { ConvertRoleToVarcharAndSeedSuperAdmin1784000000002 } from './1784000000002-ConvertRoleToVarcharAndSeedSuperAdmin';
import { CreateNotificationsTable1784000000003 } from './1784000000003-CreateNotificationsTable';
import { CreateIngredientsAndRecipes1784000000004 } from './1784000000004-CreateIngredientsAndRecipes';
import { RemoveIngredientLayer1785000000000 } from './1785000000000-RemoveIngredientLayer';
import { AddTaxAndIdempotencyToBills1786000000000 } from './1786000000000-AddTaxAndIdempotencyToBills';
import { AddModifiersSplitSyncPrint1787000000000 } from './1787000000000-AddModifiersSplitSyncPrint';
import { AddShiftIdToTabs1788000000000 } from './1788000000000-AddShiftIdToTabs';
import { AddBrandColorsToBusiness1789000000000 } from './1789000000000-AddBrandColorsToBusiness';
import { CreateDepartmentsTable1790000000000 } from './1790000000000-CreateDepartmentsTable';
import { AddSupervisorFieldsToOrders1791000000000 } from './1791000000000-AddSupervisorFieldsToOrders';
import { AddTrackingAndTimestampsToOrders1792000000000 } from './1792000000000-AddTrackingAndTimestampsToOrders';
import { CreateAdvertisementsTable1793000000000 } from './1793000000000-CreateAdvertisementsTable';
import { CreatePermissionsAndRoles1794000000000 } from './1794000000000-CreatePermissionsAndRoles';
import { CreateStockMovementsTable1795000000000 } from './1795000000000-CreateStockMovementsTable';
import { AddBusinessCodeToBusinesses1796000000000 } from './1796000000000-AddBusinessCodeToBusinesses';
import { BackfillBusinessCodes1796000000001 } from './1796000000001-BackfillBusinessCodes';
import { AddTokenVersionFields1797000000000 } from './1797000000000-AddTokenVersionFields';
import { MakeAdBranchIdNullable1798000000000 } from './1798000000000-MakeAdBranchIdNullable';
import { MakeExistingAdsUniversal1798000000001 } from './1798000000001-MakeExistingAdsUniversal';
import { CreateMenuCategoriesTable1799000000000 } from './1799000000000-CreateMenuCategoriesTable';
import { CreateUnitsTable1799000000001 } from './1799000000001-CreateUnitsTable';
import { AddTabType1800000000001 } from './1800000000001-AddTabType';
import { AddFulfillmentType1800000000002 } from './1800000000002-AddFulfillmentType';
import { RelocateTrackingToTabs1800000000003 } from './1800000000003-RelocateTrackingToTabs';
import { MakeWaiterIdNullable1800000000004 } from './1800000000004-MakeWaiterIdNullable';
import { ConsolidateEnsureTables1800000000005 } from './1800000000005-ConsolidateEnsureTables';
import { CreatePlatformPaymentProvidersTable1801000000000 } from './1801000000000-CreatePlatformPaymentProvidersTable';
import { CreateFeedbackTable1802000000000 } from './1802000000000-CreateFeedbackTable';
import { AddCancelledFieldsToOrders1803000000000 } from './1803000000000-AddCancelledFieldsToOrders';
import { AddIsVipToTables1804000000000 } from './1804000000000-AddIsVipToTables';
import { AddVipSurchargePercentToBusinesses1805000000000 } from './1805000000000-AddVipSurchargePercentToBusinesses';
import { AddServiceChargePercentToBusinesses1806000000000 } from './1806000000000-AddServiceChargePercentToBusinesses';
import { AddInactiveToTableStatus1807000000000 } from './1807000000000-AddInactiveToTableStatus';
import { CreateReviewsTable1808000000000 } from './1808000000000-CreateReviewsTable';
import { AddNavigationPermissions1809000000000 } from './1809000000000-AddNavigationPermissions';
import { AddPrepTypeToMenuItems1810000000000 } from './1810000000000-AddPrepTypeToMenuItems';
import { CreateShiftTemplates1810000000000 } from './1810000000000-CreateShiftTemplates';
import { AddBusinessIdToShiftTemplates1811000000000 } from './1811000000000-AddBusinessIdToShiftTemplates';
import { AddManageShiftsPermission1812000000000 } from './1812000000000-AddManageShiftsPermission';
import { AddDeviceFingerprintToRefreshTokens1813000000000 } from './1813000000000-AddDeviceFingerprintToRefreshTokens';
import { CreateDevicesTable1814000000000 } from './1814000000000-CreateDevicesTable';
import { AddManageDevicesPermission1815000000000 } from './1815000000000-AddManageDevicesPermission';
import { AddVersionColumns1816000000000 } from './1816000000000-AddVersionColumns';
import { AddUserIdToNotifications1817000000000 } from './1817000000000-AddUserIdToNotifications';
import { CreateWaiterCallsTable1818000000000 } from './1818000000000-CreateWaiterCallsTable';
import { AddMaxTablesPerWaiterToBranches1819000000000 } from './1819000000000-AddMaxTablesPerWaiterToBranches';
import { AddDiscountMinOrderToBusinesses1819500000000 } from './1819500000000-AddDiscountMinOrderToBusinesses';
import { NormalizeShiftTemplateDaysOfWeek1819900000000 } from './1819900000000-NormalizeShiftTemplateDaysOfWeek';
import { AddCountryToBusinesses1819950000000 } from './1819950000000-AddCountryToBusinesses';
import { SeedDefaultShiftTemplates1820000000000 } from './1820000000000-SeedDefaultShiftTemplates';
import { AddDeletedAtToTabs1830000000000 } from './1830000000000-AddDeletedAtToTabs';
import { ReAddDeletedAtToTabs1832000000000 } from './1832000000000-ReAddDeletedAtToTabs';
import { AddDiscountMinOrderToBusinessesFix1834000000000 } from './1834000000000-AddDiscountMinOrderToBusinessesFix';
import { NormalizeMenuItemCategories1835000000000 } from './1835000000000-NormalizeMenuItemCategories';
import { ActivateBerbadosNightlifeSubscription1836000000000 } from './1836000000000-ActivateBarbadosNightlifeSubscription';
import { ActivateBerbadosNightlifeSubscription1836000000001 } from './1836000000001-ActivateBerbadosNightlifeSubscription';
import { AddDispatchDelivery1840000000000 } from './1840000000000-AddDispatchDelivery';
import { CleanRiderVehicleData1841000000000 } from './1841000000000-CleanRiderVehicleData';
import { AddRiderPayoutTables1842000000000 } from './1842000000000-AddRiderPayoutTables';
import { AddTableReservations1843000000000 } from './1843000000000-AddTableReservations';
import { AddPrepTimeToMenuItems1860000000000 } from './1860000000000-AddPrepTimeToMenuItems';
import { AddVersionToPayoutBatches1865000000000 } from './1865000000000-AddVersionToPayoutBatches';
import { AddStandaloneOrderFields1870000000000 } from './1870000000000-AddStandaloneOrderFields';
import { AddBranchIdToBills1870000000001 } from './1870000000001-AddBranchIdToBills';
import { MakeDeliveriesTabIdNullable1870000000002 } from './1870000000002-MakeDeliveriesTabIdNullable';
import { AddStandaloneReviewFields1870000000003 } from './1870000000003-AddStandaloneReviewFields';
import { RemoveVirtualTables1870000000004 } from './1870000000004-RemoveVirtualTables';
import { AddSerialNumberToPosTerminals1870000000005 } from './1870000000005-AddSerialNumberToPosTerminals';
import { CreateMoniepointErpCredentials1870000000006 } from './1870000000006-CreateMoniepointErpCredentials';
import { CreateMoniepointErpPushes1870000000007 } from './1870000000007-CreateMoniepointErpPushes';
import { CreateWebhookEvents1880000000000 } from './1880000000000-CreateWebhookEvents';
import { VersionBootSchemaSync1880000000001 } from './1880000000001-VersionBootSchemaSync';

export const ALL_MIGRATIONS = [
  BackfillUserRoleId1752892800000,
  MakeUserRoleIdNotNull1752892800001,
  CreateBaseTables1782000000000,
  StandardizeUuidTypes1782053106763,
  AddTaxRateToBusiness1782747664791,
  EnsureSchemaConsistency1783000000000,
  CreatePlansAndSubscriptions1784000000000,
  BackfillSubscriptionsForExistingBranches1784000000001,
  ConvertRoleToVarcharAndSeedSuperAdmin1784000000002,
  CreateNotificationsTable1784000000003,
  CreateIngredientsAndRecipes1784000000004,
  RemoveIngredientLayer1785000000000,
  AddTaxAndIdempotencyToBills1786000000000,
  AddModifiersSplitSyncPrint1787000000000,
  AddShiftIdToTabs1788000000000,
  AddBrandColorsToBusiness1789000000000,
  CreateDepartmentsTable1790000000000,
  AddSupervisorFieldsToOrders1791000000000,
  AddTrackingAndTimestampsToOrders1792000000000,
  CreateAdvertisementsTable1793000000000,
  CreatePermissionsAndRoles1794000000000,
  CreateStockMovementsTable1795000000000,
  AddBusinessCodeToBusinesses1796000000000,
  BackfillBusinessCodes1796000000001,
  AddTokenVersionFields1797000000000,
  MakeAdBranchIdNullable1798000000000,
  MakeExistingAdsUniversal1798000000001,
  CreateMenuCategoriesTable1799000000000,
  CreateUnitsTable1799000000001,
  AddTabType1800000000001,
  AddFulfillmentType1800000000002,
  RelocateTrackingToTabs1800000000003,
  MakeWaiterIdNullable1800000000004,
  ConsolidateEnsureTables1800000000005,
  CreatePlatformPaymentProvidersTable1801000000000,
  CreateFeedbackTable1802000000000,
  AddCancelledFieldsToOrders1803000000000,
  AddIsVipToTables1804000000000,
  AddVipSurchargePercentToBusinesses1805000000000,
  AddServiceChargePercentToBusinesses1806000000000,
  AddInactiveToTableStatus1807000000000,
  CreateReviewsTable1808000000000,
  AddNavigationPermissions1809000000000,
  AddPrepTypeToMenuItems1810000000000,
  CreateShiftTemplates1810000000000,
  AddBusinessIdToShiftTemplates1811000000000,
  AddManageShiftsPermission1812000000000,
  AddDeviceFingerprintToRefreshTokens1813000000000,
  CreateDevicesTable1814000000000,
  AddManageDevicesPermission1815000000000,
  AddVersionColumns1816000000000,
  AddUserIdToNotifications1817000000000,
  CreateWaiterCallsTable1818000000000,
  AddMaxTablesPerWaiterToBranches1819000000000,
  AddDiscountMinOrderToBusinesses1819500000000,
  NormalizeShiftTemplateDaysOfWeek1819900000000,
  AddCountryToBusinesses1819950000000,
  SeedDefaultShiftTemplates1820000000000,
  AddDeletedAtToTabs1830000000000,
  ReAddDeletedAtToTabs1832000000000,
  AddDiscountMinOrderToBusinessesFix1834000000000,
  NormalizeMenuItemCategories1835000000000,
  ActivateBerbadosNightlifeSubscription1836000000000,
  ActivateBerbadosNightlifeSubscription1836000000001,
  AddDispatchDelivery1840000000000,
  CleanRiderVehicleData1841000000000,
  AddRiderPayoutTables1842000000000,
  AddTableReservations1843000000000,
  AddPrepTimeToMenuItems1860000000000,
  AddVersionToPayoutBatches1865000000000,
  AddStandaloneOrderFields1870000000000,
  AddBranchIdToBills1870000000001,
  MakeDeliveriesTabIdNullable1870000000002,
  AddStandaloneReviewFields1870000000003,
  RemoveVirtualTables1870000000004,
  AddSerialNumberToPosTerminals1870000000005,
  CreateMoniepointErpCredentials1870000000006,
  CreateMoniepointErpPushes1870000000007,
  CreateWebhookEvents1880000000000,
  VersionBootSchemaSync1880000000001,
];
