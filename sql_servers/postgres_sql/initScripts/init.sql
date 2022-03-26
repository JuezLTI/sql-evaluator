CREATE EXTENSION dblink;

DROP PROCEDURE IF EXISTS CREATEISOLATEUSER;
--  Create onFly user
CREATE PROCEDURE CREATEISOLATEUSER
(
  IN V_USERNAME VARCHAR(100),
  IN V_PASSWORD VARCHAR(100)
) AS $$
  DECLARE dbUserPrefix VARCHAR(20) DEFAULT 'juezLTIPrefix';
  DECLARE stmtCreateUser VARCHAR(255);
  DECLARE stmtCreateDatabase VARCHAR(255);
BEGIN
  IF LEFT(V_USERNAME, LENGTH(dbUserPrefix)) = dbUserPrefix THEN
	stmtCreateUser := 'CREATE ROLE ' || V_USERNAME || ' WITH LOGIN PASSWORD ''' || V_PASSWORD || '''';
    PERFORM dblink_exec('dbname=' || current_database()  -- current db
                        , stmtCreateUser);

	stmtCreateDatabase := 'CREATE DATABASE ' || V_USERNAME || ' OWNER ' || V_USERNAME;
    PERFORM dblink_exec('dbname=' || current_database()  -- current db
                        , stmtCreateDatabase);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop onFly user
DROP PROCEDURE IF EXISTS DROPISOLATEUSER;
CREATE  PROCEDURE DROPISOLATEUSER
(
  IN V_USERNAME VARCHAR(100)
) AS $$
  DECLARE dbUserPrefix VARCHAR(20) DEFAULT 'juezLTIPrefix';
  DECLARE stmtDropUser VARCHAR(255);
  DECLARE stmtDropDatabase VARCHAR(255);
BEGIN
  IF LEFT(V_USERNAME, LENGTH(dbUserPrefix)) = dbUserPrefix THEN
	stmtDropDatabase := 'DROP DATABASE ' || V_USERNAME;
    PERFORM dblink_exec('dbname=' || current_database()  -- current db
                        , stmtDropDatabase);
    stmtDropUser := 'DROP ROLE ' || V_USERNAME;
    PERFORM dblink_exec('dbname=' || current_database()  -- current db
                        , stmtDropUser);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- GRANT EXECUTE ON PROCEDURE **appDBName**.CREATEISOLATEUSER TO 'dbUser'@'**webServer | localhost**';
-- GRANT EXECUTE ON PROCEDURE **appDBName**.DROPISOLATEUSER TO 'dbUser'@'**webServer | localhost**';
-- It isn't necessary because, with docker, we use postgres superuser.
