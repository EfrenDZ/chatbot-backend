import { PrismaClient, BotConfig, Account as PrismaAccount } from '@prisma/client';
export const prisma = new PrismaClient();
export type Account = PrismaAccount & { botConfig?: BotConfig | null };
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
