export function isAdmin(user: { roles: string[] }): boolean {
  return user.roles.some((role) => role.toLowerCase() === 'admin')
}
