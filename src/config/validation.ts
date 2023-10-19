import { ConfigurationSchema } from './schema';

export interface ConfigValidationError {
  path: string;
  message: string;
}

export type ConfigurationValidator<Config extends ConfigurationSchema> = (config: Config) => {
  success: boolean;
  errors: ConfigValidationError[];
};

export function validateConfiguration<Config extends ConfigurationSchema>(
  config: Config,
  validator: ConfigurationValidator<Config>,
) {
  const result = validator(config);
  if (!result.success) {
    throw new Error(`Configuration validation failed:
${result.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`);
  }
}
