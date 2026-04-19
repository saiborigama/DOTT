import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props){
    super(props)
    this.state = { hasError:false }
  }

  static getDerivedStateFromError(){
    return { hasError:true }
  }

  componentDidCatch(error){
    console.error('Customer app crashed:', error)
    try{
      const recoveryKey = 'dott_startup_recovery_done'
      const alreadyRecovered = sessionStorage.getItem(recoveryKey) === '1'
      if(!alreadyRecovered){
        sessionStorage.setItem(recoveryKey, '1')
        ;[
          'dott_cart',
          'dott_rv',
          'dott_recent_locations',
          'dott_location_ready',
          'dott_last_known_location',
          'dott_radius_km',
        ].forEach((key)=>{
          try{ localStorage.removeItem(key) }catch{}
        })
      }
    }catch{}
  }

  handleReload = () => {
    try{ sessionStorage.removeItem('dott_startup_recovery_done') }catch{}
    window.location.reload()
  }

  handleClearAndReload = () => {
    try{
      localStorage.removeItem('dott_cart')
      localStorage.removeItem('dott_rv')
      localStorage.removeItem('dott_recent_locations')
      localStorage.removeItem('dott_location_ready')
      localStorage.removeItem('dott_last_known_location')
      localStorage.removeItem('dott_radius_km')
      sessionStorage.removeItem('dott_startup_recovery_done')
    }catch{}
    window.location.reload()
  }

  render(){
    if(!this.state.hasError) return this.props.children
    return (
      <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'#eef6ff',fontFamily:'sans-serif'}}>
        <div style={{maxWidth:420,width:'100%',background:'#fff',border:'1px solid #bfdbfe',borderRadius:16,padding:20,boxShadow:'0 12px 30px rgba(30,64,175,.12)'}}>
          <h2 style={{margin:'0 0 8px',color:'#1d4ed8'}}>DOTT could not open</h2>
          <p style={{margin:'0 0 16px',color:'#334155'}}>A startup issue was detected. You can reload now or reset temporary app data.</p>
          <div style={{display:'flex',gap:10}}>
            <button onClick={this.handleReload} style={{flex:1,height:42,borderRadius:10,border:'1px solid #93c5fd',background:'#fff',color:'#1d4ed8',fontWeight:700,cursor:'pointer'}}>Reload</button>
            <button onClick={this.handleClearAndReload} style={{flex:1,height:42,borderRadius:10,border:'none',background:'#60a5fa',color:'#fff',fontWeight:700,cursor:'pointer'}}>Reset & Reload</button>
          </div>
        </div>
      </div>
    )
  }
}

const rootEl = document.getElementById('root')
if(!rootEl){
  throw new Error('Root element #root not found')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)
