import dotenv from 'dotenv'
dotenv.config()

function validateNonNull(value?: string) {
  if(value === undefined) throw new Error(".env not valid");
  return value;
}
class EnvProps {
  readonly DATABASE_URL: string;
  readonly GROQ_API_KEY: string;
  readonly LLM_MODEL: string;
  readonly HOST: string;
  readonly NODE_ENV: string;
  readonly LOG_LEVEL: string;
  readonly ENABLE_METRICS: string;
  constructor() {
    this.DATABASE_URL = validateNonNull(process.env.DATABASE_URL);
    this.GROQ_API_KEY = validateNonNull(process.env.GROQ_API_KEY);
    this.LLM_MODEL = validateNonNull(process.env.LLM_MODEL);
    this.HOST = validateNonNull(process.env.HOST);
    this.NODE_ENV = validateNonNull(process.env.NODE_ENV);
    this.LOG_LEVEL = validateNonNull(process.env.LOG_LEVEL);
    this.ENABLE_METRICS = validateNonNull(process.env.ENABLE_METRICS);
  }
}

const envProps = new EnvProps();
export default envProps;