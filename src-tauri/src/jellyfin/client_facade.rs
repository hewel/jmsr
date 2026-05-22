#[cfg(test)]
pub(crate) fn assert_login_interface(client: &super::client::JellyfinClient) {
  let login = client.login();
  let _ = login.connection_state();
  let _ = login.is_connected();
  let _ = login.get_saved_session();
}

#[cfg(test)]
pub(crate) fn assert_playback_interface(client: &super::client::JellyfinClient) {
  let playback = client.playback();
  let _ = playback.device_id();
}
