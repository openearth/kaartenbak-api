const { buildChildrenTree } = require('./build-children-tree')

function buildMenuTree(menus) {
  buildChildrenTree(menus)

  const removeParentProperty = (menu) => {
    const { parent, children = [], ...item } = menu
    return {
      ...item,
      ...(children.length
        ? { children: children.map(removeParentProperty) }
        : {}),
    }
  }

  return menus.filter((menu) => menu.parent === null).map(removeParentProperty)
}

module.exports = {
  buildMenuTree,
}