data modify storage math:internal w set from storage math:internal x
data modify storage math:internal x set compute default math:exp/reduce/quotient/00
data modify storage math:internal x set compute default math:common/rounding/add_half
function math:internal/floor_x
data modify storage math:internal x set compute default math:exp/reduce/remainder/00
data modify storage math:internal x set compute default math:exp/00
return 1
