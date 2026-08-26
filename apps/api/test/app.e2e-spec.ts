import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { TrackingService } from './../src/modules/tracking/tracking.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    DataSource: jest.fn().mockImplementation(() => ({
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn((e) => e),
        create: jest.fn((e) => e),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findAndCount: jest.fn(),
        createQueryBuilder: jest.fn(),
        metadata: { columns: [], relations: [] },
      }),
      entityMetadatas: [],
      transaction: jest.fn(),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn(),
          findOne: jest.fn(),
          save: jest.fn((e) => e),
          create: jest.fn((e) => e),
          update: jest.fn(),
        }),
      },
      options: {},
      isInitialized: true,
      destroy: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    })),
  };
});

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn((e) => e),
  create: jest.fn((e) => e),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockRepo()),
  entityMetadatas: [],
  transaction: jest.fn(),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo()) },
  options: {},
  isInitialized: true,
  destroy: jest.fn(),
  initialize: jest.fn().mockResolvedValue(undefined),
};

const mockTrackingService = {
  generateUniqueCode: jest.fn().mockResolvedValue('TST-CODE'),
};

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .overrideProvider(TrackingService)
      .useValue(mockTrackingService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
