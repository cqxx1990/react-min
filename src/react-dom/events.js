const Events = {
  click: "onClick",
  change: "onChange"
}
export function proxyEvent(container) {
  Object.entries(Events).forEach(([k, v]) => {
    container.addEventListener(k, (e) => {
      let target = e.target;
      while (target) {  // 模拟事件冒泡
        if (target.__react_props) {
          const clickAction = target.__react_props[v];
          if (clickAction) {
            clickAction(e);
            // 这里还可以判断e是否停止冒泡了，用来模拟终止冒泡的场景
          }
        }
        target = target.parentNode;
      }
    });
  })
}