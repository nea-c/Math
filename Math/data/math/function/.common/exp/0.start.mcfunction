data modify storage math: internal.w set from storage math: internal.x
data modify storage math: internal.x set compute default float math:exp/reduce/quotient/00
data modify storage math: internal.x set compute default float math:.common/rounding/add_half
function math:.common/floor/0.start
data modify storage math: internal.x set compute default float math:exp/reduce/remainder/00
data modify storage math: internal.x set compute default float math:exp/00
return 1
