export const keys = {
  user: (id: string) => `user:${id}`,
  userConsejeros: (id: string) => `user:${id}:consejeros`,
  userGenerals: (id: string) => `user:${id}:generals`,
  general: (gid: string) => `general:${gid}`,
  poolPower: () => 'pool:power',
  lbSeason: (n: number | string) => `lb:season:${n}`,
  battle: (bid: string) => `battle:${bid}`,
  idemp: (token: string) => `idemp:${token}`,
  rateLimitRun: (id: string, windowKey: string) => `rate:${id}:run:${windowKey}`,
  firstPost: () => 'game:firstPost',
};
