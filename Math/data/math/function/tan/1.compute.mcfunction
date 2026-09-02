execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"internal.x"},test:0} run \
  return run data modify storage math: ans set from storage math: a
data modify storage math: ans set compute default float math:tan
