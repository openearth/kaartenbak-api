export function formatMenu(menu) {
  const formattedLayers = menu.children?.map(({ layer, child, ...metadataFields }) => {
    return {
      ...layer,
      ...metadataFields,
      ...(child && { children: [child] })
    }
  }) || [];

  return {
    ...menu,
    children: formattedLayers
  }
}

export function formatMenusRecursive(menus) {
  if (!menus) {
    return menus;
  }

  return menus.map((menu) => {
    const formattedMenu = formatMenu(menu);

    return {
      ...formattedMenu,
      children: formatMenusRecursive(formattedMenu.children) // Ensure we use the formatted children
    };
  });
}