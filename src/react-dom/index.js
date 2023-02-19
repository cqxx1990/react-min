import { renderWithHooks } from "./hooks";
import { PLACEMENT_FLAG, UPDATE_FLAG } from "./defines";
import { FiberNode, createWorkInProgress, cloneChildFibers } from "./fiber";
import { proxyEvent } from "./events";
import { commit } from "./commit";

/**当前协调中的fiber */
let workInProgress = null;
/**0:空闲，1:协调中，2:渲染中 */
let workState = 0;

export function render(element, container) {
  const fiber = new FiberNode(element.type, element.props); // rootFiber，但是和官方的不一样，本demo的方案简化过
  const root = {
    current: fiber,
    stateNode: container,
    type: "div",
  };
  fiber.return = root; // 简化了root和rootFiber的结构。官方是rootFiber.stateNode = root
  scheduleUpdateOnFiber(fiber, true);
  proxyEvent(container); // 代理事件
}
export function scheduleUpdateOnFiber(fiber, isFirst) {
  const isWorking = workState === 1;
  workState = 1; // 全局变量标记当前在协调中
  fiber.lanes = 1; // 标记当前节点有更新
  if (fiber.alternate) {
    fiber.alternate.lanes = 1;
  }
  let root = fiber;
  while (root.return) {
    root = root.return;
    if (root.return) {
      root.childLanes = 1; //向上冒泡父节点，标记此节点的子节点有更新，在beginWork中遇到此情况就直接拷贝子节点
      if (root.alternate) {
        root.alternate.childLanes = 1;
      }
    }
  }

  workInProgress = createWorkInProgress(root.current); // 切换fiber.alternate为当前协调的fiber
  if (isFirst) {
    workInProgress.return = root; // 因为简化了root和rootFiber，所以这两行作为补充
    workInProgress.flags |= PLACEMENT_FLAG | UPDATE_FLAG;
  }

  if (isWorking) {
    // 如果正在协调中，只要workInProgress重置了就会重新生成fiber树，因此不需要request更新了
    return;
  }
  requestIdleCallback(workLoop.bind(null, root)); // 用浏览器的requestIdleCallback来模拟schedule
}

function workLoop(root, deadline) {
  while (workInProgress && deadline.timeRemaining() > 1) {
    // 有空闲时间才渲染
    performUnitOfWork(workInProgress);
  }
  if (workState === 2) {
    // 协调完成
    commit(root);
    workState = 0;
  }
  if (workInProgress) {
    requestIdleCallback(workLoop.bind(null, root));
  }
}
function performUnitOfWork(work) {
  const next = beginWork(work); // 向下生成子节点
  if (next) {
    workInProgress = next;
  } else {
    completeUnitOfWork(work); //向上回溯父节点的兄弟节点，同时会对新元素生成stateNode，同时标记flags
  }
}

function beginWork(work) {
  if (work.lanes) {
    // 当前节点有变更
    const CompType = typeof work.type;
    if (CompType === "string") {
      // 说明是html标签，如div,span
      reconcileChildren(
        work,
        work.pendingProps ? work.pendingProps.children : []
      );
      return work.child;
    } else if (CompType === "function") {
      const children = renderWithHooks(work); // 计算出出子节点的elements
      reconcileChildren(work, children); // 将elements转换为fibers
      return work.child;
    }
  }
  if (work.childLanes) {
    // 子节点有变更，拷贝子节点
    cloneChildFibers(work);
    return work.child;
  }
  // 没有变更，不管，因为父级拷贝自父级的alternate，且子节点不需要构建了
}

function reconcileChildren(work, newChildren) {
  // 预处理children，并将children转换为fiber链表
  const current = work.alternate;
  const childrenType = typeof newChildren;
  if (childrenType === "string" || childrenType === "number") {
    newChildren = [newChildren];
  }
  if (!newChildren) return null;
  if (!Array.isArray(newChildren)) {
    newChildren = [newChildren];
  }
  if (!current) {
    // 本节点都没有
    // work.child = mountFiberChildren(work,null,newChildren)
    work.child = updateFiberChildren(work, null, newChildren); // 官方的源码使用的上面一个函数，原因是官方的代码中，回溯阶段会直接将新创建元素的子节点直接添加到父节点，只留父节点的flags为placement；而当前的代码是回溯阶段不管，全部由commit阶段添加
  } else {
    work.child = updateFiberChildren(work, current.child, newChildren);
  }
}
/**
 * diff和创建fiber阶段
 * @param {FiberNode} work 当前节点
 * @param {FiberNode} oldFiber 当前节点上一次渲染的第一个子节点
 * @param {elements} newChildren 新生成的element列表
 * @returns
 */
function updateFiberChildren(work, oldFiber, newChildren) {
  let resultChild = null;
  let fiber = null;
  let preFiber = null;
  for (let i = 0; i < newChildren.length; ++i) {
    // 对比fiber链表和children，标记删除更新创建。本处的diff是简化过的，且没有key,index计算
    const element = newChildren[i];
    const elementType = typeof element;
    let type, props;
    if (elementType === "string" || elementType === "number") {
      // 为字符串和数组单独命名一个类型，因为他们的dom节点创建方式不一样
      type = "TEXT";
      props = element;
    } else {
      type = element.type;
      props = element.props;
    }
    if (oldFiber) {
      if (oldFiber.type === type) {
        // 如果元素的类型相同，则直接更新属性
        fiber = createWorkInProgress(oldFiber, props);
        fiber.lanes |= 1; // 标记这个fiber是有更新的，否则下一次循环的额beginWork里面会忽略这个节点
      } else {
        fiber = new FiberNode(type, props); // 类型不一样，则是新节点
        fiber.flags |= PLACEMENT_FLAG | UPDATE_FLAG;
        (work.deletions || (work.deletions = [])).push(oldFiber); // 新节点的情况下，要把旧的节点保持到删除数组中，在commit的阶段删除
        fiber.lanes |= 1;
      }
      oldFiber = oldFiber.sibling;
    } else {
      fiber = new FiberNode(type, props);
      fiber.flags |= PLACEMENT_FLAG | UPDATE_FLAG;
      fiber.lanes |= 1;
    }
    fiber.return = work;
    if (resultChild) {
      // 如果第一个child已经有值了，说明这是非第一个元素，则将上一个fiber的sibling赋值为这次的fiber
      preFiber.sibling = fiber;
    } else {
      resultChild = fiber; // 标记第一个child
    }
    preFiber = fiber; // 缓存这次的fiber，用于下一次循环的上一个fiber
  }
  return resultChild; // 将第一个child返回出去，赋值给父节点的child
}

/**
 * 往兄弟节点和父节点的fiber回溯
 * @param {FiberNode} work
 * @returns
 */
function completeUnitOfWork(work) {
  do {
    const parent = work.return;

    completeWork(work); // 完成节点的标记

    if (work.sibling) {
      workInProgress = work.sibling; // 向兄弟节点遍历
      return;
    }

    work = parent; // 如果当前节点没有下一个兄弟节点，则向上到父节点，标记后后找父节点的兄弟节点
    workInProgress = work;
  } while (work);

  workState = 2; // 如果回溯到最一个节点，也就是root，则标记回溯完成
}
/**
 * 检查并设置更新标记，在commit的时候用。官方还标记了fiber的subtreeFlags，用于标记子节点有没有更新
 * @param {FiberNode} work
 */
function completeWork(work) {
  const elementType = typeof work.type;
  if (elementType === "string") {
    if (work.stateNode) {
      if (work.memorizedProps === work.pendingProps) {
      } else {
        work.flags |= UPDATE_FLAG; // props发生变化，则标记为更新。官方的方案是对比props里面的属性，找到更新的列表，有列表才标记，并将列表存储在了fiber.updateQueue中
      }
    } else {
      // 如果没有创建过dom节点，说明是新节点，则预先创建dom节点
      work.stateNode = createElementNode(work);
      work.flags |= UPDATE_FLAG;
    }
  } else if (elementType === "function") {
    // function的组件不需要dom操作，所以为空
  }
}

function createElementNode(work) {
  // 新节点创建
  if (work.type === "TEXT") {
    return document.createTextNode(work.pendingProps);
  }
  return document.createElement(work.type);
}
