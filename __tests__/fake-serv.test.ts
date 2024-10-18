import http from 'http';
import path from 'path';

import { describe, expect, test } from 'vitest';
import request from 'supertest';

import {
  listen,
  ServiceStartOptions,
  startApp,
} from '../src/index.js';

import { type FakeServLocals, service } from './fake-serv/src/index.js';

function httpRequest(options: http.RequestOptions) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve(responseData);
      });
    });
    req.on('error', (e) => {
      reject(e);
    });
    req.end();
  });
}

describe('fake-serv', () => {
  test('basic service functionality', async () => {
    const options: ServiceStartOptions<FakeServLocals> = {
      service,
      name: 'fake-serv',
      rootDirectory: path.resolve(__dirname, './fake-serv'),
      codepath: 'src',
      version: '1.0.0',
    };

    const app = await startApp(options).catch((error) => {
      console.error(error);
      throw error;
    });
    expect(app.locals.config.server.port).not.toEqual(0);
    expect(app).toBeTruthy();

    let { body } = await request(app).get('/world').timeout(500).expect(200);
    expect(body.hello).toEqual('world');

    ({ body } = await request(app).get('/other/world').timeout(500).expect(200));
    expect(body.hello).toEqual('jupiter');

    ({ body } = await request(app)
      .get('/hello')
      .query({ greeting: 'Hello Pluto!', number: '6', break_things: true })
      .expect(200));
    expect(body.greeting).toEqual('Hello Pluto!');

    // Can't convert green to a number
    await request(app)
      .get('/hello')
      .query({ greeting: 'Hello Pluto!', number: 'green' })
      .expect(400);

    // Make sure body paramater conversion works
    await request(app).post('/hello').send({ number: 'green' }).expect(400);
    await request(app).post('/hello').send({ number: '6' }).expect(204);
    await request(app).post('/hello').send({ number: 6 }).expect(204);

    ({ body } = await request(app).get('/error/sync').timeout(1000).expect(500));
    expect(body.code).toEqual('SyncError');

    ({ body } = await request(app).get('/error/async').timeout(1000).expect(500));
    expect(body.code).toEqual('AsyncError');

    // Mocking
    await request(app).post('/world').expect(500);

    const server = await listen(app);
    // Exercise the http module
    await httpRequest({
      hostname: 'localhost',
      port: app.locals.config.server.port,
      path: '/hello?greeting=Hello&number=6',
      method: 'GET',
    });
    await request(app.locals.internalApp)
      .get('/metrics')
      .expect(200)
      .expect((res) => {
        expect(res.text).toMatch(/nodejs_version_info{version/);
        expect(res.text).toMatch(/# UNIT http_server_duration ms/);
        expect(res.text).toMatch(/world_requests_total{method="get"} 1/);
        expect(res.text).toContain(
          'http_request_duration_seconds_bucket{status_code="200",method="GET",path="/world"',
        );
      });

    // Clean shutdown
    await new Promise<void>((accept, reject) => {
      server.close((e) => {
        if (e) {
          reject(e);
        } else {
          accept();
        }
      });
    });
  });
});
