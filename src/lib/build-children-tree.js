function buildChildrenTree(items) {
  items.forEach((item) => {
    if (item.parent) {
      const parent = items.find((p) => p.id === item.parent.id)
      if (parent.children == null) {
        parent.children = []
      }
      parent.children.push(item)
    }
  })
}

module.exports = {
  buildChildrenTree
}