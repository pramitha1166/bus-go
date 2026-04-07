import 'dotenv/config'
import db from '../lib/db'

const prisma = db

async function main() {
  const schedules = await prisma.schedule.findMany()
  
  console.log(`Found ${schedules.length} schedules to migrate.`)

  for (const s of schedules) {
    // @ts-ignore - since we just updated the schema, the old field might still be in the fetched object
    // but the new field will be there as well
    const rawDepartureAt = s.departureAt
    if (!rawDepartureAt) continue

    const time = new Date(rawDepartureAt)
    const departureTime = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
    
    console.log(`Updating schedule ${s.id}: ${departureTime}`)
    
    await prisma.schedule.update({
      where: { id: s.id },
      data: {
        departureTime,
        departureAt: s.isRecurring ? null : rawDepartureAt
      }
    })
  }

  console.log('Migration complete.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
