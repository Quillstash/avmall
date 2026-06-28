-- The Expenses permissions (expenses.view/create/edit/delete) were added after
-- the system roles were first seeded in 20260605140000_add_roles, so existing
-- super_admin / manager role rows don't grant them. Append them here.
--
-- Idempotent: DISTINCT de-dupes, so re-running never adds duplicate keys. Runs
-- after add_roles, so fresh setups get the permissions too. Permission order
-- is irrelevant (membership is what's checked).

UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p
  FROM unnest(
    "permissions" || ARRAY[
      'expenses.view',
      'expenses.create',
      'expenses.edit',
      'expenses.delete'
    ]
  ) AS p
)
WHERE "slug" IN ('super_admin', 'manager');
