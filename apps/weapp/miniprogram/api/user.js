function req() {
  return getApp().globalData.request
}

export const getUserInfo = (id) => req().get(`/users/${id}`)
export const postLogin = (data) => req().post('/auth/login', data)
export const postRegister = (data) => req().post('/auth/register', data)
export const putUserInfo = (id, data) => req().put(`/users/${id}`, data)
