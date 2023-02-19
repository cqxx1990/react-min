import React from "react";
import { scheduleUpdateOnFiber } from "./index";

/**当前渲染的fiber */
let hooksFiber = null;
/**当前fiber运行的hook */
let workInProgressHook = null;
/**当前fiber的影子节点的hook，也就是上一次渲染的hook */
let currentHook = null;

/**
 * 注入hooks，然后运行函数生成子节点的elements
 * @param {FiberNode} work
 * @returns
 */
export function renderWithHooks(work) {
  work.lanes = 0;
  work.memorizedState = null;
  hooksFiber = work;
  // 注入dispatcher。官方的源码也是注入的，不过形式不一样
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
    work.alternate ? updateDispatcher : mountDispatcher;
  // 调用function生成子节点的elements
  const children = work.type(work.pendingProps);
  workInProgressHook = null;
  currentHook = null;
  return children;
}

const mountDispatcher = {
  useState: mountState,
  // 其他hooks没有支持
};
const updateDispatcher = {
  useState: updateState,
  // 其他hooks没有支持
};

/**
 * 第一次调用useState，会初始化hook对象，存储到fiber的memorizedState上
 * @param {any} initialState
 * @returns
 */
function mountState(initialState) {
  const hook = {
    memorizedState: null,
    queue: {
      dispatch: null,
      pending: null,
    },
    next: null,
  };
  if (workInProgressHook) {
    workInProgressHook = workInProgressHook.next = hook;
  } else {
    hooksFiber.memorizedState = workInProgressHook = hook;
  }

  hook.memorizedState = initialState;
  const dispatch = dispatchSetState.bind(null, hooksFiber, hook.queue);
  hook.queue.dispatch = dispatch;

  return [hook.memorizedState, dispatch];
}
/**
 * 拿到上一次的hook的state，再获取本次hook的更新队列，用更新队列的值处理state，并存储到本次hook的memorizedState上
 * @param {any} initialState 实际上没有用上
 * @returns
 */
function updateState(initialState) {
  if (currentHook) {
    // 上一次渲染的hooks
    currentHook = currentHook.next;
  } else {
    const oldFiber = hooksFiber.alternate;
    if (oldFiber) {
      currentHook = oldFiber.memorizedState;
    } else {
      currentHook = null;
    }
  }
  if (workInProgressHook) {
    workInProgressHook = workInProgressHook.next;
  } else {
    workInProgressHook = hooksFiber.memorizedState;
  }

  if (!workInProgressHook) {
    // 如果本地没有，说明是第二次运行到此hooks，生成节点到hooksFiber上
    const hook = {
      memorizedState: currentHook.memorizedState,
      queue: {
        // 官方的实现中，这个queue复用了currentHook.queue，个人觉得这个不是很科学
        dispatch: null,
        pending: null,
      },
      next: null,
    };
    hook.queue.dispatch = dispatchSetState.bind(null, hooksFiber, hook.queue);
    if (hooksFiber.memorizedState) {
      workInProgressHook = hooksFiber.memorizedState.next = hook;
    } else {
      hooksFiber.memorizedState = workInProgressHook = hook;
    }
  }

  const queue = currentHook.queue;
  let newState = currentHook.memorizedState;
  if (queue.pending) {
    const first = queue.pending.next;
    let update = first;
    do {
      newState =
        typeof update.action === "function"
          ? update.action(newState)
          : update.action;
      update = update.next;
    } while (update !== first); // queue.pending是个环状链表，如果又回到此节点，说明更新执行完了
    workInProgressHook.memorizedState = newState;
  }

  workInProgressHook.queue.pending = null;
  return [newState, workInProgressHook.queue.dispatch];
}
/**
 * 生成update对象，存储到当前hook的queue.pending环形链表中
 * @param {Fiber} fiber
 * @param {*} queue
 * @param {*} action
 */
function dispatchSetState(fiber, queue, action) {
  console.log("注入hooks的dispatch调用");
  const update = {
    action,
    next: null,
  };
  if (queue.pending) {
    // 这里是个环，用环的原因是不用保存头节点和尾节点。用环的方案每次都在头节点的前面插入一个即可，用的时候直接取此对象的next即是头节点
    update.next = queue.pending.next;
    queue.pending.next = update;
  } else {
    update.next = update;
  }
  queue.pending = update;
  //
  scheduleUpdateOnFiber(fiber);
}
