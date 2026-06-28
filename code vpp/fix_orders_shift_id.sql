-- Fix orders to have shift_id
-- For each order without shift_id, find the corresponding CLOSED shift
UPDATE orders o
SET o.shift_id = (
  SELECT s.id FROM shifts s
  WHERE s.user_id = o.seller_id 
  AND s.status = 'CLOSED'
  AND s.opened_at <= o.created_at 
  AND s.closed_at >= o.created_at
  LIMIT 1
)
WHERE o.shift_id IS NULL
AND o.seller_id IS NOT NULL
AND o.created_at IS NOT NULL;

-- Verify the update
SELECT COUNT(*) as total_orders, 
       SUM(CASE WHEN shift_id IS NOT NULL THEN 1 ELSE 0 END) as orders_with_shift,
       SUM(CASE WHEN shift_id IS NULL THEN 1 ELSE 0 END) as orders_without_shift
FROM orders;
