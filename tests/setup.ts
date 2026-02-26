// Set test environment variables BEFORE any app imports
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.UAZAPI_BASE_URL = 'http://localhost:9999';
process.env.UAZAPI_API_KEY = 'test-uazapi-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.NODE_ENV = 'test';
