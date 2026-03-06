DO $$
DECLARE
  tbl_col RECORD;
BEGIN
  FOR tbl_col IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.udt_name = 'UserRole' AND c.table_schema = 'public'
  LOOP
    EXECUTE format('UPDATE %I SET %I = ''SENIOR'' WHERE %I = ''TEAM_LEAD''', tbl_col.table_name, tbl_col.column_name, tbl_col.column_name);
    EXECUTE format('UPDATE %I SET %I = ''MANAGER'' WHERE %I = ''MANAGING_PARTNER''', tbl_col.table_name, tbl_col.column_name, tbl_col.column_name);
    EXECUTE format('UPDATE %I SET %I = ''FIRM_ADMIN'' WHERE %I = ''ADMIN'' AND %I != ''FIRM_ADMIN'' AND %I != ''SUPER_ADMIN''', tbl_col.table_name, tbl_col.column_name, tbl_col.column_name, tbl_col.column_name, tbl_col.column_name);
    RAISE NOTICE 'Migrated %.%', tbl_col.table_name, tbl_col.column_name;
  END LOOP;
END $$;
