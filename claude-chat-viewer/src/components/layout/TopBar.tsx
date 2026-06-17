function TopBar() {
  return (
    <header style={{
      height: '48px',
      backgroundColor: '#faf8f5',
      borderBottom: '1px solid #e8e2d8',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '24px',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '12px', color: '#8c8580' }}>
        本地聊天记录浏览器
      </span>
    </header>
  )
}

export default TopBar
