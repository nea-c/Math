data modify storage math: internal.w set from storage math: internal.x
data modify storage math: internal.x set compute default float {"type":"mul","inputs":[{"type":"storage","storage":"math:","path":"internal.x"},1.4426950216293335]}
data modify storage math: internal.x set compute default float {"type":"add","inputs":[{"type":"storage","storage":"math:","path":"internal.x"},0.5]}
function math:.common/floor/0.start
data modify storage math: internal.x set compute default float math:exp/reduce/remainder/00
return run data modify storage math: internal.x set compute default float {"type":"mul","inputs":["math:exp/polynomial/00","math:exp/factor/00","math:exp/scale/00"]}
