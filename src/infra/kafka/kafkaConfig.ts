import { env } from '../../config/env.config';
import { KafkaConfig, logLevel, SASLOptions } from 'kafkajs';

// build kafka config based on the environment variables
const CONNECTION_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 30000;

export function buildKafkaConfig(clientIdSuffix?: string): KafkaConfig {
  const brokers = env.KAFKA_HOST_IP ? env.KAFKA_HOST_IP.split(',') : env.KAFKA_BROKERS.split(',');
  const clientId = clientIdSuffix ? `${env.KAFKA_CLIENT_ID}-${clientIdSuffix}` : env.KAFKA_CLIENT_ID;
  const kafkaConfig: KafkaConfig = {
    logLevel: logLevel.INFO,
    brokers,
    clientId,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    requestTimeout: REQUEST_TIMEOUT_MS,
  };
  const protocol = (env.KAFKA_SECURITY_PROTOCOL || (env.KAFKA_SSL_ENABLED ? 'SASL_SSL' : 'PLAINTEXT')).toUpperCase();

  if (protocol === 'SASL_SSL' || protocol === 'SASL_PLAINTEXT') {
    kafkaConfig.ssl = protocol === 'SASL_SSL' ? (env.KAFKA_SSL_REJECT_UNAUTHORIZED ? true : { rejectUnauthorized: false }) : false;
    const mechanism = env.KAFKA_SASL_MECHANISM || (protocol === 'SASL_SSL' ? 'scram-sha-512' : 'plain');
    kafkaConfig.sasl = { mechanism, username: env.KAFKA_USERNAME, password: env.KAFKA_PASSWORD } as SASLOptions;
  }

  return kafkaConfig;
}