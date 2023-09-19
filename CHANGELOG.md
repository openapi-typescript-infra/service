## [2.7.2](https://github.com/openapi-typescript-infra/service/compare/v2.7.1...v2.7.2) (2023-09-19)


### Bug Fixes

* **types:** add a container type to make life easier ([a74ded1](https://github.com/openapi-typescript-infra/service/commit/a74ded1b784443375ee1e3fee32c60140759eb3a))

## [2.7.1](https://github.com/openapi-typescript-infra/service/compare/v2.7.0...v2.7.1) (2023-09-18)


### Bug Fixes

* **otlp:** dummy exporter needs to flush records ([8d6d1a3](https://github.com/openapi-typescript-infra/service/commit/8d6d1a3cd42531f4ad0f8678eec66dab1b9e45a0))

# [2.7.0](https://github.com/openapi-typescript-infra/service/compare/v2.6.7...v2.7.0) (2023-09-18)


### Features

* **otlp:** cleanup OTLP setup, though still sketchy ([5ee63ac](https://github.com/openapi-typescript-infra/service/commit/5ee63ac6d3d519fb8d6a9d321d0bf59991e7db40))

## [2.6.7](https://github.com/openapi-typescript-infra/service/compare/v2.6.6...v2.6.7) (2023-09-17)


### Bug Fixes

* **ts:** switch to tsc-alias ([4fd845d](https://github.com/openapi-typescript-infra/service/commit/4fd845dd5795aec14af2ea59aa97eb8a0b6aeef1))

## [2.6.6](https://github.com/openapi-typescript-infra/service/compare/v2.6.5...v2.6.6) (2023-09-17)


### Bug Fixes

* **ts:** automatically run tsconfig-replace-paths if it exists ([cf89107](https://github.com/openapi-typescript-infra/service/commit/cf89107065df3da5d920e8032bdf00feea0f64c1))

## [2.6.5](https://github.com/openapi-typescript-infra/service/compare/v2.6.4...v2.6.5) (2023-09-17)


### Bug Fixes

* **glob:** ignore spec, fixture and test files when loading routes ([350ccd6](https://github.com/openapi-typescript-infra/service/commit/350ccd66f439830ef976df02d312e4bae0ac567d))

## [2.6.4](https://github.com/openapi-typescript-infra/service/compare/v2.6.3...v2.6.4) (2023-09-17)


### Bug Fixes

* **make:** allow bundling of spec to deterministic path ([16ff04e](https://github.com/openapi-typescript-infra/service/commit/16ff04ee7c55868cf65f0b686ca99db416b78eff))

## [2.6.3](https://github.com/openapi-typescript-infra/service/compare/v2.6.2...v2.6.3) (2023-09-16)


### Bug Fixes

* **openapi:** use latest cli ([2cf2fa2](https://github.com/openapi-typescript-infra/service/commit/2cf2fa222b56ac607c1d9eed0313d6efcd1cf738))

## [2.6.2](https://github.com/openapi-typescript-infra/service/compare/v2.6.1...v2.6.2) (2023-09-16)


### Bug Fixes

* **openapi:** depend on all files in subdirs ([d4eaa2c](https://github.com/openapi-typescript-infra/service/commit/d4eaa2cdbaa791bb250f41ce6703c32f8c90b192))

## [2.6.1](https://github.com/openapi-typescript-infra/service/compare/v2.6.0...v2.6.1) (2023-09-16)


### Bug Fixes

* **openapi:** proper dependency for split spec files ([cc82772](https://github.com/openapi-typescript-infra/service/commit/cc827722939113faf5e03d7b5685dc38e6ceeb52))

# [2.6.0](https://github.com/openapi-typescript-infra/service/compare/v2.5.0...v2.6.0) (2023-09-16)


### Bug Fixes

* **openapi:** bundle the service definition before type generation ([18ba0b4](https://github.com/openapi-typescript-infra/service/commit/18ba0b48289d18fd12b35bdb0275efa0d7edafd4))


### Features

* **otlp:** update opentelemetry and other deps ([330e7d1](https://github.com/openapi-typescript-infra/service/commit/330e7d169a03dbeda873186012167834711d8923))

# [2.5.0](https://github.com/openapi-typescript-infra/service/compare/v2.4.1...v2.5.0) (2023-09-05)


### Features

* **port:** determine service port earlier - before service starts ([c593f27](https://github.com/openapi-typescript-infra/service/commit/c593f27dae20ea19fdd8f79611b16c2b179d7a4d))

## [2.4.1](https://github.com/openapi-typescript-infra/service/compare/v2.4.0...v2.4.1) (2023-09-04)


### Bug Fixes

* **server:** log proper port on startup ([7fa4ba5](https://github.com/openapi-typescript-infra/service/commit/7fa4ba59c38b8e534c80f061ef0f8660ac07ee09))

# [2.4.0](https://github.com/openapi-typescript-infra/service/compare/v2.3.0...v2.4.0) (2023-09-02)


### Features

* **lifecycle:** add a method pre-route loading to attach locals ([e20da8b](https://github.com/openapi-typescript-infra/service/commit/e20da8b13957436c149a4eeb0794a8560243c876))

# [2.3.0](https://github.com/openapi-typescript-infra/service/compare/v2.2.0...v2.3.0) (2023-09-01)


### Bug Fixes

* **ci:** update default permissions ([7d4b1ce](https://github.com/openapi-typescript-infra/service/commit/7d4b1ce383eb403706798599586fcf54ca533a50))
* **ci:** update semantic release job permissions ([5fe90c8](https://github.com/openapi-typescript-infra/service/commit/5fe90c893ea682c77b4d896b1964a9e4b7fe6624))


### Features

* **logs:** better startup logging including URL ([a3f7146](https://github.com/openapi-typescript-infra/service/commit/a3f7146d10cb530999fb027d9f9769343eda1039))

# [2.2.0](https://github.com/openapi-typescript-infra/service/compare/v2.1.0...v2.2.0) (2023-09-01)


### Features

* **config:** handle tilde for homedir in path and file shortstops ([3c4abdc](https://github.com/openapi-typescript-infra/service/commit/3c4abdc9bfa3657a5fe9cbeae4cb8f50e990e9df))

# [2.1.0](https://github.com/openapi-typescript-infra/service/compare/v2.0.2...v2.1.0) (2023-09-01)

### Features

- **tls:** allow TLS listeners, handle errors better ([005e79a](https://github.com/openapi-typescript-infra/service/commit/005e79a76cdc6fe2c73006f8931b0085bce4a895))

## [2.0.2](https://github.com/openapi-typescript-infra/service/compare/v2.0.1...v2.0.2) (2023-08-26)

### Bug Fixes

- **paths:** include tsconfig-paths during dev ([b1a5c14](https://github.com/openapi-typescript-infra/service/commit/b1a5c1450bc3736a397731602453473c6ad5df8f))

## [2.0.1](https://github.com/openapi-typescript-infra/service/compare/v2.0.0...v2.0.1) (2023-08-17)

### Bug Fixes

- **loading:** preserve paths in route loader ([878c94d](https://github.com/openapi-typescript-infra/service/commit/878c94d18486372dc0fe234aac343e6a73cae73e))

# [2.0.0](https://github.com/openapi-typescript-infra/service/compare/v1.2.2...v2.0.0) (2023-08-17)

### Bug Fixes

- **test:** move to vitest ([360c0ae](https://github.com/openapi-typescript-infra/service/commit/360c0ae8f4dfcf8ac0650980543340f97e72da5b))

### BREAKING CHANGES

- **test:** module loading mechanics have changed

  # 1.0.0

- Migrated from @gas-buddy organization to openapi-typescript-infra
- Reworked some GB specific wording
