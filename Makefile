ifeq ($(realpath $(lastword $(MAKEFILE_LIST))), $(realpath $(firstword $(MAKEFILE_LIST))))
$(error The Makefile in @openapi-typescript-infra/service is meant to be included, not executed directly)
endif

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

build_dir := $(shell node -e "console.log(require('./package.json').exports.replace(/^.\//, '').split('/')[0])")
src_files := $(shell find src -name '*.ts')
build_files := $(patsubst src/%.ts,$(build_dir)/%.js,$(src_files))
camel_case_name := $(shell echo $(SERVICE_NAME) | awk -F- '{result=""; for(i=1; i<=NF; i++) result = result toupper(substr($$i,1,1)) substr($$i,2); print result}' | tr -d '\n')
# tsgo is pretty cool. Maybe you should try it?
TSC ?= tsc

ts: $(word 1, $(build_files))

clean:
	yarn dlx rimraf ./$(build_dir) src/generated tsconfig.build.tsbuildinfo

$(word 1, $(build_files)): $(src_files)
	yarn $(TSC) -p tsconfig.build.json
	@if yarn info tsc-alias name > /dev/null 2>&1; then \
		yarn tsc-alias --project tsconfig.build.json; \
	fi

service: src/generated/service/index.ts

bundlespec:
	npx --yes @redocly/cli@latest bundle ./api/${SERVICE_NAME}.yaml -o $(BUNDLE_OUTPUT)/openapi-spec.json

src/generated/service/index.ts: $(shell find api -type f)
	echo "Building service interface"
ifndef BUNDLE_OUTPUT
		$(eval BUNDLE_OUTPUT := $(shell mktemp -d))
		$(eval GENERATED_DIR := true)
endif
	$(MAKE) bundlespec SERVICE_NAME=$(SERVICE_NAME) BUNDLE_OUTPUT=$(BUNDLE_OUTPUT)
	yarn dlx openapi-typescript-express $(BUNDLE_OUTPUT)/openapi-spec.json \
		--output ./src/generated/service/index.ts
	yarn prettier ./src/generated/service/index.ts --write
ifdef GENERATED_DIR
		rm -rf $(BUNDLE_OUTPUT)
endif

# Config schema generation
CONFIG_TYPE_SRC ?= src/types/config.ts
CONFIG_TYPE ?= $(camel_case_name)ConfigSchema
CONFIG_TS_CONFIG ?= tsconfig.tsup.json

config-schema: src/generated/config-validator.ts

src/generated/config-validator.ts: $(CONFIG_TYPE_SRC)
	yarn typia-standalone-validator --force \
		$(CONFIG_TYPE_SRC) $(CONFIG_TYPE) \
		--project $(CONFIG_TS_CONFIG) -o src/generated/config-validator.ts

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

dbi: src/generated/database.ts

src/generated/database.ts: $(wildcard migrations/* migrations/**/*)
	echo "Generating database types"
	envfile=$$(mktemp) && \
	echo "DATABASE_URL=postgres://$(PGUSER):$(PGPASSWORD)@$(PGHOST)/$(DB_NAME)" > $$envfile && \
	yarn kysely-codegen \
		--env-file $$envfile \
		--dialect postgres --default-schema public \
		--out-file src/generated/database.ts
