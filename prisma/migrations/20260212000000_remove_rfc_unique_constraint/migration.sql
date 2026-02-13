-- DropIndex: Remove unique constraint on RFC to allow multiple departments per company
DROP INDEX IF EXISTS "CompanyRequest_rfc_key";
