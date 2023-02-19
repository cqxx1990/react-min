import {NoLanes} from './defines'
export function FiberNode(type, pendingProps) {
  // Instance
  this.type = type;     // 组件的类型，如果是dom元素则是html标签[div,span等]，如果是函数组件，则是对应的函数
  this.stateNode = null;    // dom元素

  // Fiber
  this.return = null;     // 父fiber
  this.child = null;      // 第一个子fiber
  this.sibling = null;    // 后一个兄弟fiber

  this.pendingProps = pendingProps;   // 即将生效的属性
  this.memoizedProps = null;      // 已经生效的属性
  this.memoizedState = null;      // 在函数组件的时候，是hooks对象，里面包含了更新列表

  // Effects
  this.flags = 0;         // 更新标记，在commit阶段会用来判断是更新还是添加节点
  this.deletions = null;  // 本节点有哪些子节点需要删除

  this.lanes = NoLanes;   // 官方是用来标记优先级的，本demo主要作为标记是否有更新
  this.childLanes = NoLanes;    // 子节点是否有更新

  this.alternate = null;    // 影子对象，影子对象和自己切换使用
}

/**
 * 如果当前fiber的alternate不存在，则创一个，并相互用alternate引用。如果存在，则把fiber的状态拷贝到alternate上，并返回alternate，如此就复用了旧的fiber
 * @param {*} work 
 * @param {*} pendingProps 
 * @returns 
 */
export function createWorkInProgress(work, pendingProps) {
  let alternate = work.alternate;
  if (!alternate) {
    alternate = new FiberNode(work.type, pendingProps);
    alternate.stateNode = work.stateNode;
    alternate.alternate = work;
    work.alternate = alternate;
  } else {
    alternate.pendingProps = pendingProps;
    alternate.type = work.type;
  }
  alternate.flags = work.flags;
  alternate.childLanes = work.childLanes;
  alternate.lanes = work.lanes;

  alternate.child = work.child;
  alternate.memorizedProps = work.memorizedProps;
  alternate.memorizedState = work.memorizedState; // hooks
  alternate.sibling = work.sibling;

  return alternate;
}
/**
 * 克隆子fiber
 * @param {FiberNode} work 
 * @returns 
 */
export function cloneChildFibers(work) {
  if (work.child === null) {
    return;
  }

  let currentChild = work.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  work.child = newChild;

  newChild.return = work;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    );
    newChild.return = work;
  }
  newChild.sibling = null;
}