Project reorganized structure

- src/: server and core modules
  - src/server.js
  - src/database.js

- public/: static frontend
  - public/index.html

- scripts/
  - scripts/images/: image-related utilities
    - sync_categories_and_images.js
  - scripts/db/: database maintenance and import scripts
    - ensure_barcode_column.js
    - fix_product_categories.js
    - fix_vpp_categories_by_name.js
    - list_product_prefixes.js
    - run_railway_schema.js
    - run_railway_sql.js
  - scripts/orders/: order-related helpers/tests
    - make_order_fetch.js
  - scripts/validation/: quick validation scripts
    - check_users.js
    - check_user_password.js
    - check_category_sales.js

- sql/: SQL schema and seed files
  - railway_schema.sql
  - railway_seed_products.sql
  - schema_pos_vpp.sql
  - set_product_images.sql

- package.json, .env, node_modules/

Notes:
- I removed several one-off/test scripts you confirmed as redundant.
- If you want any files archived instead of permanently deleted, I can restore them from git if available or recreate backups before any further deletes.
