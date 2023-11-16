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
camel_case_name := $(shell echo $(SERVICE_NAME) | awk -F- '{result=""; for(i=1; i<=NF; i++) result = result toupper(substr($$i,1,1)) substr($$i,2); print result}' | tr -d '\n')

# General utilities
clean:
	yarn dlx rimraf ./$(build_dir) src/generated

# Typescript items
ts: $(word 1, $(build_files))

$(word 1, $(build_files)): $(src_files)
	./node_modules/.bin/tsc -p tsconfig.build.json
	@if [ -d "node_modules/tsc-alias" ]; then \
		yarn tsc-alias --project tsconfig.build.json; \
	fi

service: src/generated/service/index.ts

bundlespec:
	npx --yes @redocly/cli@latest bundle ./api/${SERVICE_NAME}.yaml -o $(BUNDLE_OUTPUT)/openapi-spec.json

src/generated/service/index.ts: $(shell find api -type f)
	echo "Building service interface"
	$(eval BUNDLE_OUTPUT := $(shell mktemp -d))
	$(MAKE) bundlespec SERVICE_NAME=$(SERVICE_NAME) BUNDLE_OUTPUT=$(BUNDLE_OUTPUT)
	yarn dlx openapi-typescript-express $(BUNDLE_OUTPUT)/openapi-spec.json \
		--output ./src/generated/service/index.ts
	yarn prettier ./src/generated/service/index.ts --write
	rm -rf $(TMP)

# Config schema generation
CONFIG_TYPE_SRC ?= src/types/config.ts
CONFIG_TYPE ?= $(camel_case_name)ConfigSchema

config-schema: src/generated/config-validator.ts

src/generated/config-validator.ts: src/types/config.ts
	npx -y @sesamecare-oss/typia-standalone-validator \
		$(CONFIG_TYPE_SRC) $(CONFIG_TYPE) \
		--project tsconfig.json -o src/generated/config-validator.ts

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
	DATABASE_URL=postgres://$(PGUSER):$(PGPASSWORD)@$(PGHOST)/$(DB_NAME) yarn kysely-codegen \
		--dialect postgres --schema public \
		--out-file src/generated/database.ts
