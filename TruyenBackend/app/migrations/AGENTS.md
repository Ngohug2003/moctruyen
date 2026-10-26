# Migration ownership

Use the same settings URL and ORM Base/metadata as runtime; import all relevant models. Revisions track constraints/indexes and carry a proper down_revision chain. Review autogeneration, avoid assuming sequential integers when branches exist. Migration service must use the API DB/volume, never a separate ephemeral DB as in the reference. No create_all/reset-db/down -v as schema deployment. Verify on disposable PostgreSQL when implementation is requested.
