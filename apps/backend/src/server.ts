import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false
      }
    }
  }
});
app.get('/', async () => {
  return {
    message: 'chillar backend is running',
    status: 'healthy'
  };
});

app.get('/health', async () => ({
  status: 'healthy',
  service: 'chillar-backend'
}));

const start = async () => {
  try {
    await app.listen({ port: 3000 });
    console.log('server is running on port 3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();