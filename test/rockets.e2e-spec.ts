import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from '@elastic/elasticsearch';
import { RocketsModule } from '../apps/rockets/src/rockets.module'
import { MessagesServiceModule } from '../apps/messages-service/src/messages-service.module'

describe('Rockets API (e2e)', () => {
  let app: INestApplication;
  let esClient: Client;

  const rocketUuid = 'e2e-test-rocket-' + Date.now();

  const launchMessage = {
    metadata: {
      channel: rocketUuid,
      messageNumber: 1,
      messageTime: new Date().toISOString(),
      messageType: 'RocketLaunched',
    },
    message: {
      type: 'Falcon-Heavy',
      launchSpeed: 1000,
      mission: 'MARS-COLONY',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RocketsModule, MessagesServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });

    await esClient.deleteByQuery({
      index: 'rockets',
      query: { term: { 'metadata.rocketUuid': rocketUuid } },
      refresh: true,
    }).catch(() => { });
  });

  afterAll(async () => {
    await app.close();
  });

  it('🚀 full flow: POST /messages -> verify ES -> test GET/POST endpoints', async () => {
    await request(app.getHttpServer())
      .post('/messages')
      .send(launchMessage)
      .expect(202);
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await esClient.indices.refresh({ index: 'rockets' });
    await esClient.indices.refresh({ index: 'rockets-state' });

    const listResponse = await request(app.getHttpServer())
      .get('/rockets')
      .expect(200);

    const foundRocket = listResponse.body.find(
      (r: any) => r.rocketUuid === rocketUuid
    );

    expect(foundRocket).toBeDefined();
    expect(foundRocket?.mission).toBe('MARS-COLONY');

    const detailResponse = await request(app.getHttpServer())
      .get(`/rockets/${rocketUuid}`)
      .expect(200);

    expect(detailResponse.body.metadata.rocketUuid).toBe(rocketUuid);
    expect(detailResponse.body.message.type).toBe('Falcon-Heavy');

    const searchResponse = await request(app.getHttpServer())
      .post('/rockets/search')
      .send({ 'message.mission': 'MARS-COLONY' })
      .expect(201);

    expect(searchResponse.body.length).toBeGreaterThanOrEqual(1);
    const searchedRocket = searchResponse.body.find(
      (rocket: any) => rocket.metadata.rocketUuid === rocketUuid
    );

    expect(searchedRocket).toBeDefined();
    expect(searchedRocket.metadata.rocketUuid).toBe(rocketUuid);
    expect(searchedRocket.message.mission).toBe('MARS-COLONY');
  });

  it('GET /rockets/:rocketUuid should return 404 for non-existent rocket', async () => {
    await request(app.getHttpServer())
      .get('/rockets/non-existent-uuid')
      .expect(404);
  });
});
