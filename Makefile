# This Makefile is intended to be called by higher level/project Makefiles
# It bakes in a number of standard practices include the use of the src
# directory (choose your build dir as appropriate).
#
# It also includes database scripts, which technically aren't the concern of this
# module, but very often services do have a database component but don't need
# any sort of service-specific database modules (just plain pg). So this Makefile
# has targets for setting up a database for the service, and generating types
# using kysely, and using db-migrate for schema managment.
#
# With all that, you can have a Makefile that does this:
#
# .PHONY: all service dbi ts
#
# export DB_NAME ?= cool_db
# export SERVICE_NAME ?= my-cool-serv
#
# include node_modules/@openapi-typescript-infra/service/Makefile
#
# all: service dbi ts
#

build_dir := $(shell node -e "console.log(require('./package.json').main.replace(/^.\//, '').split('/')[0])")
src_files := $(shell find src -name '*.ts')
build_files := $(patsubst src/%.ts,$(build_dir)/%.js,$(src_files))

# General utilities
clean:
	yarn dlx rimraf ./$(build_dir) src/generated

# Typescript items
ts: $(word 1, $(build_files))

$(word 1, $(build_files)): $(src_files)
	./node_modules/.bin/tsc -p tsconfig.build.json

service: src/generated/service/index.ts

src/generated/service/index.ts: api/**
	echo "Building service interface"
	$(eval TMP := $(shell mktemp -d))
	yarn dlx @redocly/openapi-cli@latest bundle ./api/${SERVICE_NAME}.yaml -o $(TMP)/api.yaml
	yarn dlx openapi-typescript-express $(TMP)/api.yaml \
		--output ./src/generated/service/index.ts
	./node_modules/.bin/prettier ./src/generated/service/index.ts --write
	rm -rf $(TMP)

# Postgres database things
export PGUSER ?= postgres
export PGPASSWORD ?= postgres
export PGHOST ?= localhost

db-ci:
	yarn run-pg-sql -q postgres ./migrations/setup/ci_setup.sql
	yarn run-pg-sql -q postgres ./migrations/setup/db_setup.sql
	yarn migration:apply
	yarn run-pg-sql $(DB_NAME) ./migrations/setup/dev_setup.sql

db-drop:
	yarn run-pg-sql -q postgres -e "DROP DATABASE IF EXISTS $(DB_NAME);"

db+:
	yarn migration:apply

db-:
	yarn migration:undo

db-clean: db-drop db-ci

dbi:
	echo "Generating database types"
	DATABASE_URL=postgres://$(PGUSER):$(PGPASSWORD)@$(PGHOST)/$(DB_NAME) yarn kysely-codegen \
		--dialect postgres --schema public \
		--out-file src/generated/database.ts
