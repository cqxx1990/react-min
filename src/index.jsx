import React, { useState } from 'react'
import { render } from './react-dom'

function Inputer(props) {
  const [value, setValue] = useState("")
  return <div>
    <input type="text" onChange={e => setValue(e.target.value)} />
    <button onClick={() => props.onChange(value)}>确认</button>
  </div>
}
function Content() {
  const [value, setValue] = useState("")
  const [term, setTerm] = useState(0)
  const onChange = v => {
    setValue(v)
    console.log("onchange",v)
    setTerm(v => v + 1)
  }
  console.log(value)
  return <div>
    <Inputer onChange={onChange} />
    <div>第{term}次输入</div>
    <div>确认输入的内容是:{value}</div>
  </div>
}
function App() {
  // 由于省略了rootFiber，所以最顶层的不能使用hooks
  return <div>
    <h2>react的最小实现，包含useState，functionComponent，事件</h2>
    <Content />
  </div>
}
console.log(<App />)
render(<App />, document.getElementById("root"))

