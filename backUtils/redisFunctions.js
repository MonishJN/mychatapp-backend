
export async function markOnline(redis, userid) {
  const key = `friends:${userid}`;
  try {
     await redis.sAdd(key,'online');

  } catch (err) {
    console.error(`❌ Redis set failed for ${key}:`, err);
  }
}


export async function markOffline(redis, userid) {
  try {
    await redis.del(`friends:${userid}`);
    await redis.del(`chats:${userid}`);

  } catch (err) {
    console.error(`❌ Redis set failed for ${key}:`, err);
  }
  
}