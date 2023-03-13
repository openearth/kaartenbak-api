export function filterDeadLayerLinks(deadLayerLinks) {
  const deadLayerLinksCopy = JSON.parse(JSON.stringify(deadLayerLinks))

  const filter = (menus) => {
    for (const [index, menu] of menus.entries()) {
      const { children } = menu

      if (children) {
        filter(children)
        menu.children = menu.children.filter((item) => item)
      }

      if ((!menu.children || menu.children.length === 0) && !menu.link) {
        delete menus[index]
      }
    }
  }

  filter(deadLayerLinksCopy)

  return deadLayerLinksCopy.filter((viewer) => viewer)
}
