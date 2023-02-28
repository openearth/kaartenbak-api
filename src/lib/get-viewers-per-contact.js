export function getViewersPerContact(menuTree) {
  const menuTreeCopy = JSON.parse(JSON.stringify(menuTree))
  const contacts = new Map()

  menuTreeCopy.forEach(viewer => {
    viewer?.deadLinksReportContacts?.forEach(({ email }) => {
      if (contacts.has(email)) {
        const contactViewers = contacts.get(email)
        contactViewers.push(viewer)
        return
      }

      contacts.set(email, [viewer])
    })

    delete viewer.deadLinksReportContacts
  })

  return Array.from(contacts)
}