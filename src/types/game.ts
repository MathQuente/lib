import { Prisma } from '@prisma/client';

export type Game = Prisma.GameGetPayload<{
  include: {
    categories: true;
    dlcs: true;
    gameStudios: true;
    gameLaunchers: { include: { platforms: true } };
    platforms: true;
    publishers: true;
  };
}>;
