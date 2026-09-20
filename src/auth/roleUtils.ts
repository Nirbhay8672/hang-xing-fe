export function isAdmin(user: { roles: string[] }): boolean {
  return user.roles.some((role) => role.toLowerCase() === 'admin')
}

export function isMarketing(user: { roles: string[] }): boolean {
  return user.roles.some((role) => role.toLowerCase() === 'marketing')
}
