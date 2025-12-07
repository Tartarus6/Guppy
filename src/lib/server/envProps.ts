import dotenv from 'dotenv'
dotenv.config()

function validateNonNull(value?: string) {
  if(value === undefined) throw new Error(".env not valid");
  return value;
}

function getOptional(value?: string, defaultValue?: string) {
  return value || defaultValue;
}

class EnvProps {
  readonly DATABASE_URL: string;
  readonly GROQ_API_KEY: string;
  readonly LLM_MODEL: string;
  readonly HOST: string;
  readonly NODE_ENV: string;
  readonly LOG_LEVEL: string;
  readonly ENABLE_METRICS: string;
  readonly AUTH_USERNAME: string;
  readonly AUTH_PASSWORD: string;
  readonly SERVER_PORT: string;
  readonly START_SERVER: string | undefined;
  
  constructor() {
    this.DATABASE_URL = validateNonNull(process.env.DATABASE_URL);
    this.GROQ_API_KEY = validateNonNull(process.env.GROQ_API_KEY);
    this.LLM_MODEL = validateNonNull(process.env.LLM_MODEL);
    this.HOST = validateNonNull(process.env.HOST);
    this.NODE_ENV = validateNonNull(process.env.NODE_ENV);
    this.LOG_LEVEL = validateNonNull(process.env.LOG_LEVEL);
    this.ENABLE_METRICS = validateNonNull(process.env.ENABLE_METRICS);
    this.AUTH_USERNAME = validateNonNull(process.env.AUTH_USERNAME);
    this.AUTH_PASSWORD = validateNonNull(process.env.AUTH_PASSWORD);
    this.SERVER_PORT = getOptional(process.env.SERVER_PORT, '3000') || '3000';
    this.START_SERVER = process.env.START_SERVER;
  }
}

const envProps = new EnvProps();
export default envProps;