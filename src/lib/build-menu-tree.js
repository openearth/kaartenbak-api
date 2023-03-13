import { buildChildrenTree } from './build-children-tree.js'

export function buildMenuTree(menus) {
  const menusCopy = JSON.parse(JSON.stringify(menus))
  buildChildrenTree(menusCopy)

  const removeParentProperty = (menu) => {
    const { parent, children = [], ...item } = menu
    return {
      ...item,
      ...(children.length
        ? { children: children.map(removeParentProperty) }
        : {}),
    }
  }

  return menusCopy
    .filter((menu) => menu.parent === null)
    .map(removeParentProperty)
}
