## [4.5.2](https://github.com/openapi-typescript-infra/service/compare/v4.5.1...v4.5.2) (2023-10-20)


### Bug Fixes

* **make:** only build db when migrations change ([0bee073](https://github.com/openapi-typescript-infra/service/commit/0bee0737c84d8053f62e340f64715c1e2c4f69b3))

## [4.5.1](https://github.com/openapi-typescript-infra/service/compare/v4.5.0...v4.5.1) (2023-10-19)


### Bug Fixes

* **config:** remove unused config ([263d084](https://github.com/openapi-typescript-infra/service/commit/263d0841ca630760ddff2f746f73870c4d8eddee))

# [4.5.0](https://github.com/openapi-typescript-infra/service/compare/v4.4.0...v4.5.0) (2023-10-19)


### Features

* **config:** expose helpers for configuration validation ([4659807](https://github.com/openapi-typescript-infra/service/commit/46598073015ac36c83f9872d986345af1e6b4f28))

# [4.4.0](https://github.com/openapi-typescript-infra/service/compare/v4.3.4...v4.4.0) (2023-10-19)


### Bug Fixes

* **confit:** get latest confit and fix issue with tls keys from config ([20cab44](https://github.com/openapi-typescript-infra/service/commit/20cab443fa60b0f6ce6bad7037cba593437d9e3a))


### Features

* **config:** remove config schema generation, it's not ready yet ([9db5c98](https://github.com/openapi-typescript-infra/service/commit/9db5c981efdb3ed1dbe36acf02817a7f11fdbdd9))

## [4.3.4](https://github.com/openapi-typescript-infra/service/compare/v4.3.3...v4.3.4) (2023-10-19)


### Bug Fixes

* **openapi:** spec is in a prop of loader result ([818f204](https://github.com/openapi-typescript-infra/service/commit/818f2045e84eb1069ed729e445d974372f8e7e97))

## [4.3.3](https://github.com/openapi-typescript-infra/service/compare/v4.3.2...v4.3.3) (2023-10-19)


### Bug Fixes

* **openapi:** move openapi url to match swagger UI ([2b19d1a](https://github.com/openapi-typescript-infra/service/commit/2b19d1a3817973fa1c013c8f4f2d23e663241c3a))

## [4.3.2](https://github.com/openapi-typescript-infra/service/compare/v4.3.1...v4.3.2) (2023-10-19)


### Bug Fixes

* **make:** point to generate schema script properly ([2c3c824](https://github.com/openapi-typescript-infra/service/commit/2c3c824e08837d1323f7e09a745ca6bb39ea3b8f))

## [4.3.1](https://github.com/openapi-typescript-infra/service/compare/v4.3.0...v4.3.1) (2023-10-19)


### Bug Fixes

* **make:** use more compatible awk function ([fa9adda](https://github.com/openapi-typescript-infra/service/commit/fa9addab9be8a56e5ec99d8d6e9c436b1faccc40))

# [4.3.0](https://github.com/openapi-typescript-infra/service/compare/v4.2.0...v4.3.0) (2023-10-19)


### Bug Fixes

* **yarn:** update lockfile ([24b492b](https://github.com/openapi-typescript-infra/service/commit/24b492b4c8780a361b8187ce6e002c94d862fb27))


### Features

* **config:** add support for generating config schema validation ([a5c9c3f](https://github.com/openapi-typescript-infra/service/commit/a5c9c3f65bfc2798a97a4ffe960ffd88df9f9115))

# [4.2.0](https://github.com/openapi-typescript-infra/service/compare/v4.1.1...v4.2.0) (2023-10-18)


### Features

* **env:** support staging environments ([60baaa3](https://github.com/openapi-typescript-infra/service/commit/60baaa3e15c8a04ae10644d889c329558fb01aa8))

## [4.1.1](https://github.com/openapi-typescript-infra/service/compare/v4.1.0...v4.1.1) (2023-10-18)


### Bug Fixes

* **version:** add version info to service metadata ([d5c7efa](https://github.com/openapi-typescript-infra/service/commit/d5c7efa77b9b56b7702df778b1b1ebaea7c623fc))

# [4.1.0](https://github.com/openapi-typescript-infra/service/compare/v4.0.0...v4.1.0) (2023-10-18)


### Features

* **openapi:** expose API spec on internal server port ([ea33b95](https://github.com/openapi-typescript-infra/service/commit/ea33b9594ef891765c2be7fdf85fc0c53d3337cd))

# [4.0.0](https://github.com/openapi-typescript-infra/service/compare/v3.0.3...v4.0.0) (2023-10-18)


### Features

* **config:** expose raw configuration schema ([fae719d](https://github.com/openapi-typescript-infra/service/commit/fae719de5a73084c0580058bc59b59a74861f66f))


### BREAKING CHANGES

* **config:** No more config.get, just access config directly

## [3.0.3](https://github.com/openapi-typescript-infra/service/compare/v3.0.2...v3.0.3) (2023-10-18)


### Bug Fixes

* **types:** simplify ServiceRouter by removing config arg ([8f1e334](https://github.com/openapi-typescript-infra/service/commit/8f1e334a45b6f8bed5b6c7f1e61136522e7faef9))

## [3.0.2](https://github.com/openapi-typescript-infra/service/compare/v3.0.1...v3.0.2) (2023-10-18)


### Bug Fixes

* **types:** distribute the pain of typed config across all the types ([46bdd6b](https://github.com/openapi-typescript-infra/service/commit/46bdd6bc49c97fa4fb7bba38afa56480c178fa6b))
* **types:** rework all the types to be significantly simpler ([8f05ab4](https://github.com/openapi-typescript-infra/service/commit/8f05ab41090c1eb81e1513daefd45451c6953b0a))

## [3.0.1](https://github.com/openapi-typescript-infra/service/compare/v3.0.0...v3.0.1) (2023-10-17)


### Bug Fixes

* **types:** config derives from base config ([664c0d9](https://github.com/openapi-typescript-infra/service/commit/664c0d9ef3024ea18d9a830860b56b3a4c0a4f7f))

# [3.0.0](https://github.com/openapi-typescript-infra/service/compare/v2.10.0...v3.0.0) (2023-10-17)


### Features

* **config:** move to a typed confit library ([9ff56b3](https://github.com/openapi-typescript-infra/service/commit/9ff56b3c666a0fa0f099f5a4d24365e6772ad83a))


### BREAKING CHANGES

* **config:** ServiceLocals now need a config schema

# [2.10.0](https://github.com/openapi-typescript-infra/service/compare/v2.9.2...v2.10.0) (2023-10-13)


### Bug Fixes

* **fetch:** use shared fetch instrumentation library ([75cd946](https://github.com/openapi-typescript-infra/service/commit/75cd9465a9306e80e64b756a071bba231d5a1270))
* **otel:** update opentelemetry deps that don't break ([8db35cb](https://github.com/openapi-typescript-infra/service/commit/8db35cbd2f41499e5b2c9474d61a529e5e9145c6))


### Features

* **metrics:** add node metrics ([ca5ebca](https://github.com/openapi-typescript-infra/service/commit/ca5ebca604e77b05968f0338f4fe7622ee3de91e))

## [2.9.2](https://github.com/openapi-typescript-infra/service/compare/v2.9.1...v2.9.2) (2023-10-06)


### Bug Fixes

* **config:** proper root directory for file and other path shortstops ([7a1b5bb](https://github.com/openapi-typescript-infra/service/commit/7a1b5bb2e3a6bfb5d343ec41adaf56e1c2f9f874))

## [2.9.1](https://github.com/openapi-typescript-infra/service/compare/v2.9.0...v2.9.1) (2023-10-03)


### Bug Fixes

* **repl:** pass the app to the repl attachment function ([76d77de](https://github.com/openapi-typescript-infra/service/commit/76d77de2f77cf5fabacb12db295471f988cdc6d3))

# [2.9.0](https://github.com/openapi-typescript-infra/service/compare/v2.8.2...v2.9.0) (2023-10-03)


### Features

* **repl:** allow extra setup on REPL ([b4d0a92](https://github.com/openapi-typescript-infra/service/commit/b4d0a920de07c8717ecb623af6d6b5316394659e))

## [2.8.2](https://github.com/openapi-typescript-infra/service/compare/v2.8.1...v2.8.2) (2023-09-29)


### Bug Fixes

* **otlp:** add resource detectors ([04ee92d](https://github.com/openapi-typescript-infra/service/commit/04ee92de9c9df63dda56e8a000d803af6b7801c3))

## [2.8.1](https://github.com/openapi-typescript-infra/service/compare/v2.8.0...v2.8.1) (2023-09-29)


### Bug Fixes

* **log:** log actual metrics port ([63ba066](https://github.com/openapi-typescript-infra/service/commit/63ba0668116b700340f47981a6ca29b7926a3c6e))

# [2.8.0](https://github.com/openapi-typescript-infra/service/compare/v2.7.7...v2.8.0) (2023-09-29)


### Features

* **otlp:** rework OpenTelemetry integration to deal with limitations… ([#10](https://github.com/openapi-typescript-infra/service/issues/10)) ([5ce6e42](https://github.com/openapi-typescript-infra/service/commit/5ce6e42d76041142c23aec5cd5738173197e9613))

## [2.7.7](https://github.com/openapi-typescript-infra/service/compare/v2.7.6...v2.7.7) (2023-09-27)


### Bug Fixes

* **deps:** upgrade to avoid CVE-2022-24999 in qs ([fb85750](https://github.com/openapi-typescript-infra/service/commit/fb8575098ce876d71dd6898a8f70f0bf47e78b37))

## [2.7.6](https://github.com/openapi-typescript-infra/service/compare/v2.7.5...v2.7.6) (2023-09-24)


### Bug Fixes

* **openapi:** change filename of JSON spec for clarity ([3807027](https://github.com/openapi-typescript-infra/service/commit/3807027141073cefd8e3f29d692864b9b0007a07))

## [2.7.5](https://github.com/openapi-typescript-infra/service/compare/v2.7.4...v2.7.5) (2023-09-22)


### Bug Fixes

* **log:** use sync logging for tests ([832cdfb](https://github.com/openapi-typescript-infra/service/commit/832cdfb8cb6c99af42740a714cf7c06dc2523538))

## [2.7.4](https://github.com/openapi-typescript-infra/service/compare/v2.7.3...v2.7.4) (2023-09-19)


### Bug Fixes

* **types:** add raw types to utility type ([f607fba](https://github.com/openapi-typescript-infra/service/commit/f607fba897a76e88652472946f64d225da302c9e))

## [2.7.3](https://github.com/openapi-typescript-infra/service/compare/v2.7.2...v2.7.3) (2023-09-19)


### Bug Fixes

* **types:** add express type ([79de1d4](https://github.com/openapi-typescript-infra/service/commit/79de1d4ac107454cf08623c3d837f5cb84b18c4a))

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
