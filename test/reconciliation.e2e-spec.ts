import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from '@elastic/elasticsearch';
import { RocketsModule } from '../apps/rockets/src/rockets.module';
import { MessagesServiceModule } from '../apps/messages-service/src/messages-service.module';

describe('State Reconciliation (e2e)', () => {
    let app: INestApplication;
    let esClient: Client;

    const rocketUuid = 'recon-test-' + Date.now();

    const msg1_Launch = {
        metadata: {
            channel: rocketUuid,
            messageNumber: 1,
            messageTime: new Date(Date.now() - 10000).toISOString(),
            messageType: 'RocketLaunched',
        },
        message: {
            type: 'Falcon-Recon',
            launchSpeed: 1000,
            mission: 'TEST-RECON',
        },
    };

    const msg2_SpeedInc = {
        metadata: {
            channel: rocketUuid,
            messageNumber: 2,
            messageTime: new Date(Date.now()).toISOString(),
            messageType: 'RocketSpeedIncreased',
        },
        message: {
            by: 100,
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

    it('should correctly reconcile state when messages arrive out of order', async () => {
        console.log('Sending Message #2...');
        await request(app.getHttpServer())
            .post('/messages')
            .send(msg2_SpeedInc)
            .expect(202);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log('Sending Message #1...');
        await request(app.getHttpServer())
            .post('/messages')
            .send(msg1_Launch)
            .expect(202);

        await new Promise((resolve) => setTimeout(resolve, 20000));
        await esClient.indices.refresh({ index: 'rockets-state' });

        const response = await request(app.getHttpServer())
            .get(`/rockets/${rocketUuid}`)
            .expect(200);

        const state = response.body;
        console.log('Final State:', state);

        expect(state.message.launchSpeed).toBe(1100);
        expect(state.message.mission).toBe('TEST-RECON');
        expect(state.metadata.messageNumber).toBe(2);
    });
});
