import { Test, TestingModule } from '@nestjs/testing';
import { AulasController } from './aulas.controller';

describe('AulasController', () => {
  let controller: AulasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AulasController],
    }).compile();

    controller = module.get<AulasController>(AulasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
