// Legacy place -> shop, used only when the shop table has no explicit location
export const LEGACY_PLACE_SHOP = {
  BAWDHAN: 'MADHURA',
  BAVDHAN: 'MADHURA',
  HINJEWADI: 'TLS',
  WAGHOLI: 'FRIENDS',
  AKOLE: 'BALAJI',
  MUMBAI: 'KUNAL ULWE',
  KHARGHAR: 'KUNAL KHARGHAR'
}

// Joining place for a shop, in the same order as the Joining Company page:
// location column -> saved custom location -> legacy mapping -> address -> shop name.
// `shops` are rows from the `shop` table (needs shop_name, location, address).
export const resolvePlaceFromShop = (shopName, shops = []) => {
  if (!shopName) return ''
  const clean = shopName.toString().trim().toUpperCase()
  const matched = shops.find(c => (c.shop_name || '').trim().toUpperCase() === clean)
  if (matched && matched.location && matched.location.toString().trim()) {
    return matched.location.toString().trim().toUpperCase()
  }
  try {
    const custom = JSON.parse(localStorage.getItem('drinqkart_custom_shop_locations') || '{}')
    if (custom[clean] && custom[clean].trim()) return custom[clean].trim().toUpperCase()
  } catch { /* ignore unreadable localStorage */ }
  const legacy = Object.entries(LEGACY_PLACE_SHOP).find(([place, shop]) => shop === clean && place !== 'BAVDHAN')
  if (legacy) return legacy[0]
  if (matched && matched.address && matched.address.toString().trim()) {
    return matched.address.toString().trim().toUpperCase()
  }
  return clean
}

// Same lookup, fetching the shop row itself (for screens that don't hold the shop list)
export const fetchPlaceForShop = async (supabase, shopName) => {
  if (!shopName) return ''
  const { data } = await supabase.from('shop').select('*').ilike('shop_name', shopName.toString().trim())
  return resolvePlaceFromShop(shopName, data || [])
}
